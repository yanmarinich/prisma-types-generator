import { DMMF } from '@prisma/generator-helper';
import { IClassValidator, ParsedField } from './types';

const availableValidators = [
  'IsDefined',
  'Equals',
  'NotEquals',
  'IsEmpty',
  'IsIn',
  'IsNotIn',
  'IsDate',
  'IsDivisibleBy',
  'IsPositive',
  'IsNegative',
  'Min',
  'Max',
  'MinDate',
  'MaxDate',
  'IsBooleanString',
  'IsDateString',
  'IsNumberString',
  'Contains',
  'NotContains',
  'IsAlpha',
  'IsAlphaNumeric',
  'IsDecimal',
  'IsAscii',
  'IsBase32',
  'IsBase64',
  'IsIBAN',
  'IsBIC',
  'IsByteLength',
  'IsCreditCard',
  'IsCurrency',
  'IsEthereumAddress',
  'IsBtcAddress',
  'IsDataURI',
  'IsEmail',
  'IsFQDN',
  'IsFullWidth',
  'IsIsHalfWidth',
  'IsIsVariableWidth',
  'IsIsHexColor',
  'IsHSLColor',
  'IsRgbColor',
  'IsIdentityCard',
  'IsPassportNumber',
  'IsPostalCode',
  'IsHexadecimal',
  'IsOctal',
  'IsMACAddress',
  'IsIP',
  'IsPort',
  'IsISBN',
  'IsEAN',
  'IsISIN',
  'IsISO8601',
  'IsJWT',
  'IsObject',
  'IsNotEmptyObject',
  'IsLowercase',
  'IsUppercase',
  'IsLatLong',
  'IsLatitude',
  'IsLongitude',
  'IsMobilePhone',
  'IsPhoneNumber',
  'IsISO31661Alpha2',
  'IsISO31661Alpha3',
  'IsLocale',
  'IsMongoId',
  'IsMultiByte',
  'IsNumberString',
  'IsSurrogatePair',
  'IsUrl',
  'IsMagnetURI',
  'IsUUID',
  'IsFirebasePushId',
  'Length',
  'MinLength',
  'MinLength',
  'MaxLength',
  'Matches',
  'IsMilitaryTime',
  'IsHash',
  'IsMimeType',
  'IsSemVer',
  'IsISSN',
  'IsISRC',
  'ArrayContains',
  'ArrayNotContains',
  'ArrayNotEmpty',
  'ArrayMinSize',
  'ArrayMaxSize',
  'ArrayUnique',
  'IsInstance',
  'Allow',
];

const PrismaScalarToValidator: Record<string, IClassValidator> = {
  String: { name: 'IsString' },
  Boolean: { name: 'IsBoolean' },
  Int: { name: 'IsInt' },
  BigInt: { name: 'IsInt' },
  Float: { name: 'IsNumber' },
  Decimal: { name: 'IsNumber' },
  DateTime: { name: 'IsRFC3339' },
  Json: { name: 'IsJSON' },
};

function scalarToValidator(scalar: string): IClassValidator | undefined {
  return PrismaScalarToValidator[scalar];
}

function extractValidator(
  field: DMMF.Field,
  prop: string,
): IClassValidator | null {
  const regexp = new RegExp(`@${prop}(?:\\(([^)]*)\\))?.*$`, 'm');
  const matches = regexp.exec(field.documentation || '');

  if (matches) {
    return {
      name: prop,
      value: matches[1],
    };
  }

  return null;
}

/**
 * Parse all types of class validators.
 */
export function parseClassValidators(field: DMMF.Field): IClassValidator[] {
  const validators: IClassValidator[] = [];

  if (field.isRequired) {
    validators.push({ name: 'IsNotEmpty' });
  } else {
    validators.push({ name: 'IsOptional' });
  }

  if (field.isList) {
    validators.push({ name: 'IsArray' });
  } else {
    const typeValidator = scalarToValidator(field.type);
    if (typeValidator) {
      validators.push(typeValidator);
    }
  }

  if (field.documentation) {
    for (const prop of availableValidators) {
      const validator = extractValidator(field, prop);
      if (validator) {
        validators.push(validator);
      }
    }
  }

  return validators;
}

/**
 * Compose `class-validator` decorators.
 */
export function decorateClassValidators(field: ParsedField): string {
  if (!field.classValidators?.length) return '';

  let output = '';

  field.classValidators.forEach((prop) => {
    output += `@${prop.name}(${prop.value ? prop.value : ''})\n`;
  });

  return output;
}
