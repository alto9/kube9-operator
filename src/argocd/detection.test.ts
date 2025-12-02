import { describe, it, expect } from 'vitest';
import * as k8s from '@kubernetes/client-node';
import { extractVersion } from './detection.js';

describe('extractVersion', () => {
  it('extracts version from app.kubernetes.io/version label', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {
          'app.kubernetes.io/version': 'v2.8.0'
        }
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: []
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('v2.8.0');
  });

  it('extracts version from argocd.argoproj.io/version label', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {
          'argocd.argoproj.io/version': '2.7.0'
        }
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: []
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('2.7.0');
  });

  it('extracts version from generic version label', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {
          'version': 'v2.6.0'
        }
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: []
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('v2.6.0');
  });

  it('label priority: app.kubernetes.io/version takes precedence', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {
          'app.kubernetes.io/version': 'v2.8.0',
          'argocd.argoproj.io/version': 'v2.7.0',
          'version': 'v2.6.0'
        }
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: []
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('v2.8.0');
  });

  it('extracts version from image tag with v prefix', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'argocd-server',
                image: 'quay.io/argoproj/argocd:v2.8.0'
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('v2.8.0');
  });

  it('extracts version from image tag without v prefix', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'argocd-server',
                image: 'quay.io/argoproj/argocd:2.8.0'
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('v2.8.0');
  });

  it('extracts version from container with argocd in image name', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'other-container',
                image: 'nginx:latest'
              },
              {
                name: 'argocd-container',
                image: 'quay.io/argoproj/argocd:v2.7.0'
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe('v2.7.0');
  });

  it('returns null when no version labels exist and no image tag match', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'argocd-server',
                image: 'quay.io/argoproj/argocd:latest'
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe(null);
  });

  it('returns null when deployment has no containers', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: []
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe(null);
  });

  it('returns null when deployment metadata is missing', () => {
    const deployment: k8s.V1Deployment = {
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'argocd-server',
                image: 'quay.io/argoproj/argocd:v2.8.0'
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    // Should still extract from image tag even without metadata
    expect(version).toBe('v2.8.0');
  });

  it('image tag regex handles various formats', () => {
    const testCases = [
      { image: 'quay.io/argoproj/argocd:v2.8.0', expected: 'v2.8.0' },
      { image: 'quay.io/argoproj/argocd:2.8.0', expected: 'v2.8.0' },
      { image: 'argoproj/argocd:v2.7.5', expected: 'v2.7.5' },
      { image: 'argoproj/argocd:2.7.5', expected: 'v2.7.5' },
      { image: 'registry.example.com/argocd:v1.0.0', expected: 'v1.0.0' }
    ];
    
    for (const testCase of testCases) {
      const deployment: k8s.V1Deployment = {
        metadata: {
          labels: {}
        },
        spec: {
          selector: {
            matchLabels: {}
          },
          template: {
            spec: {
              containers: [
                {
                  name: 'argocd-server',
                  image: testCase.image
                }
              ]
            }
          }
        }
      };
      
      const version = extractVersion(deployment);
      expect(version).toBe(testCase.expected);
    }
  });

  it('returns null when image tag does not match semantic version pattern', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'argocd-server',
                image: 'quay.io/argoproj/argocd:latest'
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe(null);
  });

  it('handles deployment with missing spec', () => {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      }
    };
    
    const version = extractVersion(deployment);
    expect(version).toBe(null);
  });
});
