import { DMMF } from '@prisma/generator-helper';
import { IApiProperty, ParsedField } from './types';

const ApiProps = [
  'description',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'example',
];

const PrismaScalarToFormat: Record<string, { type: string; format: string }> = {
  Int: { type: 'integer', format: 'int32' },
  BigInt: { type: 'integer', format: 'int64' },
  Float: { type: 'number', format: 'float' },
  Decimal: { type: 'number', format: 'double' },
  DateTime: { type: 'string', format: 'date-time' },
};

export function isAnnotatedWithDoc(field: ParsedField): boolean {
  return ApiProps.some((prop) =>
    new RegExp(`@${prop}\\s+(.+)\\s*$`, 'm').test(field.documentation || ''),
  );
}

export function getDefaultValue(field: ParsedField): any {
  if (!field.hasDefaultValue) return undefined;

  switch (typeof field.default) {
    case 'string':
    case 'number':
    case 'boolean':
      return field.default;
    case 'object':
      if (field.default.name) {
        return field.default.name;
      }
    // fall-through
    default:
      return undefined;
  }
}

function extractAnnotation(
  field: ParsedField,
  prop: string,
): IApiProperty | null {
  const regexp = new RegExp(`@${prop}\\s+(.+)\\s*$`, 'm');
  const matches = regexp.exec(field.documentation || '');

  if (matches && matches[1]) {
    return {
      name: prop,
      value: matches[1],
    };
  }

  return null;
}

/**
 * Wrap string with single-quotes unless it's a (stringified) number, boolean, or array.
 */
function encapsulateString(value: string): string {
  return /^(?!true$|false$)[^0-9\[]/.test(value) ? `'${value}'` : value;
}

/**
 * Parse all types of annotation that can be decorated with `@ApiProperty()`.
 * @param field
 * @param include All default to `true`. Set to `false` if you want to exclude a type of annotation.
 */
export function parseApiProperty(
  field: DMMF.Field,
  include: {
    default?: boolean;
    doc?: boolean;
    enum?: boolean;
    type?: boolean;
  } = {},
): boolean {
  const incl = Object.assign(
    {
      default: true,
      doc: true,
      enum: true,
      type: true,
    },
    include,
  );
  const properties: IApiProperty[] = [];

  if (incl.doc && field.documentation) {
    for (const prop of ApiProps) {
      const property = extractAnnotation(field, prop);
      if (property) {
        properties.push(property);
      }
    }
  }

  const scalarFormat = PrismaScalarToFormat[field.type];
  if (incl.type && scalarFormat) {
    properties.push(
      { name: 'type', value: scalarFormat.type },
      { name: 'format', value: scalarFormat.format },
    );
  }

  if (incl.enum && field.kind === 'enum') {
    properties.push({ name: 'enum', value: field.type });
  }

  const defaultValue = getDefaultValue(field);
  if (incl.default && defaultValue !== undefined) {
    properties.push({ name: 'default', value: `${defaultValue}` });
  }

  if (properties.length) {
    field.apiProperty = properties;
    return true;
  }

  return false;
}

/**
 * Compose `@ApiProperty()` decorator.
 */
export function decorateApiProperty(field: ParsedField): string {
  let decorator = '';

  if (field.apiProperty?.length) {
    decorator += '@ApiProperty({\n';
    field.apiProperty.forEach((prop) => {
      decorator += `  ${prop.name}: ${
        prop.name === 'enum' ? prop.value : encapsulateString(prop.value)
      },\n`;
    });
    decorator += '})\n';
  }

  return decorator;
}
