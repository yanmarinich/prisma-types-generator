import {
  DTO_CREATE_OPTIONAL,
  DTO_RELATION_CAN_CONNECT_ON_CREATE,
  DTO_RELATION_CAN_CRAEATE_ON_CREATE,
  DTO_RELATION_MODIFIERS_ON_CREATE,
  DTO_RELATION_REQUIRED,
} from '../annotations';
import {
  isAnnotatedWith,
  isAnnotatedWithOneOf,
  isIdWithDefaultValue,
  isReadOnly,
  isRelation,
  isRequiredWithDefaultValue,
  isUpdatedAt,
} from '../field-classifiers';
import {
  concatIntoArray,
  concatUniqueIntoArray,
  generateRelationInput,
  getRelationScalars,
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  zipImportStatementParams,
} from '../helpers';

import type { DMMF } from '@prisma/generator-helper';
import type { TemplateHelpers } from '../template-helpers';
import type {
  Model,
  CreateDtoParams,
  ImportStatementParams,
  ParsedField,
  IClassValidator,
} from '../types';
import { parseApiProperty } from '../api-decorator';
import { parseClassValidators } from '../class-validator';

interface ComputeCreateDtoParamsParam {
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
}
export const computeCreateDtoParams = ({
  model,
  allModels,
  templateHelpers,
}: ComputeCreateDtoParamsParam): CreateDtoParams => {
  let hasApiProperty = false;
  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];
  const extraClasses: string[] = [];
  const classValidators: IClassValidator[] = [];

  const relationScalarFields = getRelationScalars(model.fields);
  const relationScalarFieldNames = Object.keys(relationScalarFields);

  const fields = model.fields.reduce((result, field) => {
    const { name } = field;
    const overrides: Partial<DMMF.Field> = {};
    const decorators: { classValidators?: IClassValidator[] } = {};

    if (isReadOnly(field)) return result;
    if (isRelation(field)) {
      if (!isAnnotatedWithOneOf(field, DTO_RELATION_MODIFIERS_ON_CREATE)) {
        return result;
      }
      const relationInputType = generateRelationInput({
        field,
        model,
        allModels,
        templateHelpers,
        preAndSuffixClassName: templateHelpers.createDtoName,
        canCreateAnnotation: DTO_RELATION_CAN_CRAEATE_ON_CREATE,
        canConnectAnnotation: DTO_RELATION_CAN_CONNECT_ON_CREATE,
      });

      const isDtoRelationRequired = isAnnotatedWith(
        field,
        DTO_RELATION_REQUIRED,
      );
      if (isDtoRelationRequired) overrides.isRequired = true;

      // list fields can not be required
      // TODO maybe throw an error if `isDtoRelationRequired` and `isList`
      if (field.isList) overrides.isRequired = false;

      overrides.type = relationInputType.type;
      // since relation input field types are translated to something like { connect: Foo[] }, the field type itself is not a list anymore.
      // You provide list input in the nested `connect` or `create` properties.
      overrides.isList = false;
      concatIntoArray(relationInputType.imports, imports);
      concatIntoArray(relationInputType.generatedClasses, extraClasses);
      if (!templateHelpers.config.noDependencies)
        concatIntoArray(relationInputType.apiExtraModels, apiExtraModels);
    }
    if (relationScalarFieldNames.includes(name)) return result;

    // fields annotated with @DtoReadOnly are filtered out before this
    // so this safely allows to mark fields that are required in Prisma Schema
    // as **not** required in CreateDTO
    const isDtoOptional = isAnnotatedWith(field, DTO_CREATE_OPTIONAL);

    if (!isDtoOptional) {
      if (isIdWithDefaultValue(field)) return result;
      if (isUpdatedAt(field)) return result;
      if (isRequiredWithDefaultValue(field)) return result;
    }
    if (isDtoOptional) {
      overrides.isRequired = false;
    }

    if (templateHelpers.config.classValidation) {
      decorators.classValidators = parseClassValidators({
        ...field,
        ...overrides,
      });
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!templateHelpers.config.noDependencies && parseApiProperty(field))
      hasApiProperty = true;

    if (templateHelpers.config.noDependencies) {
      if (field.type === 'Json') field.type = 'Object';
      else if (field.type === 'Decimal') field.type = 'Float';
    }

    return [...result, mapDMMFToParsedField(field, overrides, decorators)];
  }, [] as ParsedField[]);

  if (apiExtraModels.length || hasApiProperty) {
    const destruct = [];
    if (apiExtraModels.length) destruct.push('ApiExtraModels');
    if (hasApiProperty) destruct.push('ApiProperty');
    imports.unshift({ from: '@nestjs/swagger', destruct });
  }

  if (classValidators.length) {
    imports.unshift({
      from: 'class-validator',
      destruct: classValidators.map((v) => v.name).sort(),
    });
  }

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers,
  );
  if (importPrismaClient) imports.unshift(importPrismaClient);

  return {
    model,
    fields,
    imports: zipImportStatementParams(imports),
    extraClasses,
    apiExtraModels,
  };
};
