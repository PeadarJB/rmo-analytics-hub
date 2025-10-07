module.exports = {
  rules: {
    'no-hardcoded-colors': {
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string') {
              const hexPattern = /^#[0-9a-fA-F]{3,6}$/;
              if (hexPattern.test(node.value)) {
                context.report({
                  node,
                  message: 'Use CSS custom properties instead of hex colors'
                });
              }
            }
          }
        };
      }
    }
  }
};