import { loadRuntimeConfig } from './runtime.config'

describe('loadRuntimeConfig', () => {
  it('should parse defaults when optional values are missing', () => {
    const config = loadRuntimeConfig({
      API_PORT: '4000',
    })

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 4000,
      corsOrigins: ['http://localhost:3000'],
      shutdownTimeoutMs: 10000,
    })
  })

  it('should prefer PORT when Azure App Service provides it', () => {
    const config = loadRuntimeConfig({
      PORT: '8080',
      API_PORT: '4000',
    })

    expect(config.port).toBe(8080)
  })

  it('should parse comma separated CORS origins', () => {
    const config = loadRuntimeConfig({
      API_PORT: '4010',
      CORS_ORIGINS: 'http://localhost:3000,https://menupick.app',
      NODE_ENV: 'production',
      SHUTDOWN_TIMEOUT_MS: '15000',
    })

    expect(config.corsOrigins).toEqual(['http://localhost:3000', 'https://menupick.app'])
    expect(config.nodeEnv).toBe('production')
    expect(config.port).toBe(4010)
    expect(config.shutdownTimeoutMs).toBe(15000)
  })

  it('should throw when API_PORT is out of valid range', () => {
    expect(() =>
      loadRuntimeConfig({
        API_PORT: '70000',
      }),
    ).toThrow('PORT 또는 API_PORT는 1~65535 범위의 정수여야 합니다.')
  })
})
