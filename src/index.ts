import fs from 'node:fs/promises';
import path from 'node:path';
import makeDir from 'make-dir';
import { generatorHandler } from '@prisma/generator-helper';
import { parseEnvValue } from '@prisma/internals';
import { Options, resolveConfig } from 'prettier';

import { run } from './generator';

import type { GeneratorOptions } from '@prisma/generator-helper';
import type { WriteableFileSpecs, NamingStyle } from './generator/types';

export const stringToBoolean = (input: string, defaultValue = false) => {
  if (input === 'true') {
    return true;
  }
  if (input === 'false') {
    return false;
  }

  return defaultValue;
};

export const generate = (options: GeneratorOptions) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const output = parseEnvValue(options.generator.output!);
  const prettierOptions: Options | undefined =
    resolveConfig.sync(output, { useCache: false }) ||
    resolveConfig.sync(path.dirname(require.main?.filename || ''), {
      useCache: false,
    }) ||
    undefined;

  const {
    connectDtoPrefix = 'Connect',
    createDtoPrefix = 'Create',
    updateDtoPrefix = 'Update',
    dtoSuffix = 'Dto',
    entityPrefix = '',
    entitySuffix = '',
    prismaClientImport = '@prisma/client',
    fileNamingStyle = 'camel',
    outputType = 'class',
  } = options.generator.config;

  const exportRelationModifierClasses = stringToBoolean(
    options.generator.config.exportRelationModifierClasses,
    true,
  );

  const excludeEntity = stringToBoolean(
    options.generator.config.excludeEntity,
    false,
  );

  const excludePlainDto = stringToBoolean(
    options.generator.config.excludePlainDto,
    false,
  );

  const excludeCreateDto = stringToBoolean(
    options.generator.config.excludeCreateDto,
    false,
  );

  const excludeUpdateDto = stringToBoolean(
    options.generator.config.excludeUpdateDto,
    false,
  );

  const excludeConnectDto = stringToBoolean(
    options.generator.config.excludeConnectDto,
    false,
  );

  const outputToNestJsResourceStructure = stringToBoolean(
    options.generator.config.outputToNestJsResourceStructure,
    // using `true` as default value would be a breaking change
    false,
  );

  const flatResourceStructure = stringToBoolean(
    options.generator.config.flatResourceStructure,
    // using `true` as default value would be a breaking change
    false,
  );

  const reExport = stringToBoolean(
    options.generator.config.reExport,
    // using `true` as default value would be a breaking change
    false,
  );

  const supportedFileNamingStyles = ['kebab', 'camel', 'pascal', 'snake'];
  const isSupportedFileNamingStyle = (style: string): style is NamingStyle =>
    supportedFileNamingStyles.includes(style);

  if (!isSupportedFileNamingStyle(fileNamingStyle)) {
    throw new Error(
      `'${fileNamingStyle}' is not a valid file naming style. Valid options are ${supportedFileNamingStyles
        .map((s) => `'${s}'`)
        .join(', ')}.`,
    );
  }

  const classValidation = stringToBoolean(
    options.generator.config.classValidation,
    // using `true` as default value would be a breaking change
    false,
  );

  const supportedOutputTypes = ['class', 'interface'];
  if (!supportedOutputTypes.includes(outputType)) {
    throw new Error(
      `'${outputType}' is not a valid output type. Valid options are 'class' and 'interface'.`,
    );
  }

  const noDependencies = stringToBoolean(
    options.generator.config.noDependencies,
    // using `true` as default value would be a breaking change
    false,
  );

  const definiteAssignmentAssertion = stringToBoolean(
    options.generator.config.definiteAssignmentAssertion,
    false,
  );

  if (classValidation && outputType !== 'class') {
    throw new Error(
      `To use 'validation' validation decorators, 'outputType' must be 'class'.`,
    );
  }

  if (classValidation && noDependencies) {
    throw new Error(
      `To use 'validation' validation decorators, 'noDependencies' cannot be false.`,
    );
  }

  const results = run({
    output,
    dmmf: options.dmmf,
    exportRelationModifierClasses,
    outputToNestJsResourceStructure,
    flatResourceStructure,
    connectDtoPrefix,
    createDtoPrefix,
    updateDtoPrefix,
    dtoSuffix,
    entityPrefix,
    entitySuffix,
    fileNamingStyle,
    classValidation,
    outputType,
    prismaClientImport,
    noDependencies,
    excludeConnectDto,
    excludeCreateDto,
    excludeEntity,
    excludeUpdateDto,
    excludePlainDto,
    prettierOptions,
    definiteAssignmentAssertion,
  });

  const indexCollections: Record<string, WriteableFileSpecs> = {};

  if (reExport) {
    results.forEach(({ fileName }) => {
      const dirName = path.dirname(fileName);

      const { [dirName]: fileSpec } = indexCollections;
      indexCollections[dirName] = {
        fileName: fileSpec?.fileName || path.join(dirName, 'index.ts'),
        content: [
          fileSpec?.content || '',
          `export * from './${path.basename(fileName, '.ts')}.js';`,
        ].join('\n'),
      };
    });
  }

  return Promise.all(
    results
      .concat(Object.values(indexCollections))
      .map(async ({ fileName, content }) => {
        await makeDir(path.dirname(fileName));
        return fs.writeFile(fileName, content);
      }),
  );
};

generatorHandler({
  onManifest: () => ({
    defaultOutput: '../src/generated/types',
    prettyName: 'NestJS DTO Generator',
  }),
  onGenerate: generate,
});
