import type { TemplateHelpers } from './template-helpers';
import type { ConnectDtoParams } from './types';

interface GenerateConnectDtoParam extends ConnectDtoParams {
  templateHelpers: TemplateHelpers;
}
export const generateConnectDto = ({
  model,
  fields,
  templateHelpers: t,
}: GenerateConnectDtoParam) => {
  const template = `
  export ${t.config.outputType} ${t.connectDtoName(model.name)} {
    ${t.fieldsToDtoProps(fields, true, false)}
  }
  `;

  return template;
};
