// Test files may reach any layer to build their doubles.
const TESTS = '\\.(test|spec)\\.ts$';

module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'The Domain folder must not depend on any external layers (Infrastructure, UseCases, or root App).',
      severity: 'error',
      from: { path: '^src/Domain' },
      to: { path: '^src/Infrastructure|^src/UseCases|^src/app' }
    },
    {
      name: 'usecases-only-depend-on-domain',
      comment: 'Use Cases must not depend on Infrastructure or root App.',
      severity: 'error',
      from: { path: '^src/UseCases' },
      to: { path: '^src/Infrastructure|^src/app' }
    },
    {
      name: 'core-uses-no-package',
      comment: 'Domain and UseCases depend on no npm package: a library (NestJS, TypeORM, Socket.IO...) goes behind a port implemented in Infrastructure. Node built-ins stay allowed.',
      severity: 'error',
      from: { path: '^src/(Domain|UseCases)', pathNot: TESTS },
      to: { dependencyTypesNot: ['local', 'core'] }
    },
    {
      name: 'no-circular-dependencies',
      comment: 'Forbidden circular dependencies that can corrupt execution.',
      severity: 'warn',
      from: {},
      to: {
        circular: true
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    }
  }
};
