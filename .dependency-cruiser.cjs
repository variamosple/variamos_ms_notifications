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
