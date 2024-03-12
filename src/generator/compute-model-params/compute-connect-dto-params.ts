import { isId, isUnique } from '../field-classifiers';
import {
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  uniq,
  zipImportStatementParams,
} from '../helpers';

import type { DMMF } from '@prisma/generator-helper';
import type { ConnectDtoParams, ImportStatementParams } from '../types';
import { TemplateHelpers } from '../template-helpers';

interface ComputeConnectDtoParamsParam {
  model: DMMF.Model;
  templateHelpers: TemplateHelpers;
}
export const computeConnectDtoParams = ({
  model,
  templateHelpers,
}: ComputeConnectDtoParamsParam): ConnectDtoParams => {
  const imports: ImportStatementParams[] = [];
  const idFields = model.fields.filter((field) => isId(field));
  const isUniqueFields = model.fields.filter((field) => isUnique(field));

  /**
   * @ApiProperty({
   *  type: 'array',
   *  items: {
   *    oneOf: [{ $ref: getSchemaPath(A) }, { $ref: getSchemaPath(B) }],
   *  },
   * })
   * connect?: (A | B)[];
   */
  // TODO consider adding documentation block to model that one of the properties must be provided
  const uniqueFields = uniq([...idFields, ...isUniqueFields]);
  const overrides = uniqueFields.length > 1 ? { isRequired: false } : {};
  const fields = uniqueFields.map((field) =>
    mapDMMFToParsedField(field, overrides),
  );

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers,
  );
  if (importPrismaClient) imports.unshift(importPrismaClient);

  return {
    model,
    imports: zipImportStatementParams(imports),
    fields,
  };
};
