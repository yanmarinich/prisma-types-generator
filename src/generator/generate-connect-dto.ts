import type { TemplateHelpers } from './template-helpers';
import type { ConnectDtoParams } from './types';

interface GenerateConnectDtoParam extends ConnectDtoParams {
  templateHelpers: TemplateHelpers;
}
export const generateConnectDto = ({
  model,
  fields,
  imports,
  templateHelpers: t,
}: GenerateConnectDtoParam) => `
  ${t.importStatements(imports)}
  export ${t.config.outputType} ${t.connectDtoName(model.name)} {
    ${t.fieldsToDtoProps(fields, true, false)}
  }
`;
