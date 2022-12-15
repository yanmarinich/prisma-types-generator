import path from 'node:path';
import { camel, pascal, kebab, snake } from 'case';
import { logger } from '@prisma/internals';
import { Options } from 'prettier';
import { makeHelpers } from './template-helpers';
import { computeModelParams } from './compute-model-params';
import { generateConnectDto } from './generate-connect-dto';
import { generateCreateDto } from './generate-create-dto';
import { generateUpdateDto } from './generate-update-dto';
import { generateEntity } from './generate-entity';
import { generatePlainDto } from './generate-plain-dto';
import { DTO_IGNORE_MODEL } from './annotations';
import { isAnnotatedWith } from './field-classifiers';

import type { DMMF } from '@prisma/generator-helper';
import { NamingStyle, Model, WriteableFileSpecs } from './types';
import { prettierFormat } from './helpers';

interface RunParam {
  output: string;
  dmmf: DMMF.Document;
  exportRelationModifierClasses: boolean;
  outputToNestJsResourceStructure: boolean;
  flatResourceStructure: boolean;
  connectDtoPrefix: string;
  createDtoPrefix: string;
  updateDtoPrefix: string;
  dtoSuffix: string;
  entityPrefix: string;
  entitySuffix: string;
  fileNamingStyle: NamingStyle;
  classValidation: boolean;
  outputType: string;
  noDependencies: boolean;
  excludeEntity: boolean;
  excludePlainDto: boolean;
  excludeCreateDto: boolean;
  excludeUpdateDto: boolean;
  excludeConnectDto: boolean;
  prettierOptions?: Options;
  definiteAssignmentAssertion: boolean;
}

export const run = ({
  output,
  dmmf,
  ...options
}: RunParam): WriteableFileSpecs[] => {
  const {
    exportRelationModifierClasses,
    outputToNestJsResourceStructure,
    flatResourceStructure,
    fileNamingStyle = 'camel',
    classValidation,
    outputType,
    noDependencies,
    excludeConnectDto,
    excludeCreateDto,
    excludeEntity,
    excludeUpdateDto,
    excludePlainDto,
    prettierOptions,
    definiteAssignmentAssertion,
    ...preAndSuffixes
  } = options;

  const transformers: Record<NamingStyle, (str: string) => string> = {
    camel,
    kebab,
    pascal,
    snake,
  };

  const transformFileNameCase = transformers[fileNamingStyle];

  const templateHelpers = makeHelpers({
    transformFileNameCase,
    transformClassNameCase: pascal,
    classValidation,
    outputType,
    noDependencies,
    definiteAssignmentAssertion,
    ...preAndSuffixes,
  });
  const allModels = dmmf.datamodel.models;

  const filteredModels: Model[] = allModels
    .filter((model) => !isAnnotatedWith(model, DTO_IGNORE_MODEL))
    // adds `output` information for each model, so we can compute relative import paths
    // this assumes that NestJS resource modules (more specifically their folders on disk) are named as `transformFileNameCase(model.name)`
    .map((model) => ({
      ...model,
      output: {
        dto: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'dto')
          : output,
        entity: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'entities')
          : output,
      },
    }));

  const modelFiles = filteredModels.map((model) => {
    logger.info(`Processing Model ${model.name}`);

    const modelParams = computeModelParams({
      model,
      allModels: filteredModels,
      templateHelpers,
    });

    // generate connect-model.dto.ts
    const connectDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.connectDtoFilename(model.name, true),
      ),
      content: prettierFormat(
        generateConnectDto({
          ...modelParams.connect,
          templateHelpers,
        }),
        prettierOptions,
      ),
    };

    // generate create-model.dto.ts
    const createDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.createDtoFilename(model.name, true),
      ),
      content: prettierFormat(
        generateCreateDto({
          ...modelParams.create,
          exportRelationModifierClasses,
          templateHelpers,
        }),
        prettierOptions,
      ),
    };
    // TODO generate create-model.struct.ts

    // generate update-model.dto.ts
    const updateDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.updateDtoFilename(model.name, true),
      ),
      content: prettierFormat(
        generateUpdateDto({
          ...modelParams.update,
          exportRelationModifierClasses,
          templateHelpers,
        }),
        prettierOptions,
      ),
    };
    // TODO generate update-model.struct.ts

    // generate model.entity.ts
    const entity = {
      fileName: path.join(
        model.output.entity,
        templateHelpers.entityFilename(model.name, true),
      ),
      content: prettierFormat(
        generateEntity({
          ...modelParams.entity,
          templateHelpers,
        }),
        prettierOptions,
      ),
    };
    // TODO generate model.struct.ts

    // generate model.dto.ts
    const plainDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.plainDtoFilename(model.name, true),
      ),
      content: prettierFormat(
        generatePlainDto({
          ...modelParams.plain,
          templateHelpers,
        }),
        prettierOptions,
      ),
    };

    const models = [];

    if (!excludeConnectDto) models.push(connectDto);
    if (!excludeCreateDto) models.push(createDto);
    if (!excludeUpdateDto) models.push(updateDto);
    if (!excludePlainDto) models.push(plainDto);
    if (!excludeEntity) models.push(entity);

    return models;
  });

  return [...modelFiles].flat();
};
