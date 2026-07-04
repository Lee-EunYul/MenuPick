// ===================================================================
// MenuPick Application - Azure Infrastructure as Code (Bicep)
// ===================================================================
// 목적: 메뉴픽 웹앱과 API를 Azure에 배포하기 위한 인프라 코드
// 생성 리소스:
// - Resource Group
// - App Service Plan (Linux)
// - App Service (Web) - Next.js
// - App Service (API) - NestJS
// - PostgreSQL Database
// - Application Insights
// ===================================================================

param location string = 'koreacentral'
param environment string = 'prod'
param projectName string = 'menupick'

// 타임스탬프를 기반으로 고유한 리소스 이름 생성
param uniqueSuffix string = substring(uniqueString(resourceGroup().id), 0, 6)

// 데이터베이스 설정
param dbAdminUsername string = 'menupickadmin'
@secure()
param dbAdminPassword string

// PostgreSQL 설정
param dbSkuName string = 'Standard_B1ms'
param dbStorageSizeGB int = 32
param dbBackupRetentionDays int = 7

// App Service Plan 설정
param appServiceSkuName string = 'B1'
param appServiceSkuTier string = 'Basic'

// 변수 정의
var appServicePlanName = '${projectName}-${environment}-plan-${uniqueSuffix}'
var webAppName = '${projectName}-web-${environment}-${uniqueSuffix}'
var apiAppName = '${projectName}-api-${environment}-${uniqueSuffix}'
var postgresqlServerName = '${projectName}-db-${environment}-${uniqueSuffix}'
var appInsightsName = '${projectName}-insights-${environment}-${uniqueSuffix}'

// 통합 문서열 참고: 최신 API 버전 사용
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: appServiceSkuName
    tier: appServiceSkuTier
  }
  properties: {
    reserved: true
  }
}

// Application Insights - 모니터링
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
  }
}

// 웹 앱 (Next.js)
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
  }
}

// 웹 앱 설정
resource webAppConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'web'
  properties: {
    alwaysOn: true
    linuxFxVersion: 'NODE|22-lts'
    appCommandLine: 'npm start'
    numberOfWorkers: 1
  }
}

// 웹 앱 환경 변수
resource webAppSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'appsettings'
  properties: {
    NEXT_PUBLIC_API_URL: 'https://${apiAppName}.azurewebsites.net/api/v1'
    NODE_ENV: 'production'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~4'
  }
}

// API 앱 (NestJS)
resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: apiAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
  }
}

// API 앱 설정
resource apiAppConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: apiApp
  name: 'web'
  properties: {
    alwaysOn: true
    linuxFxVersion: 'NODE|22-lts'
    appCommandLine: 'npm start'
    numberOfWorkers: 1
  }
}

// API 앱 환경 변수
resource apiAppSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: apiApp
  name: 'appsettings'
  properties: {
    PORT: '8080'
    API_PORT: '8080'
    NODE_ENV: 'production'
    DATABASE_URL: 'postgresql://${dbAdminUsername}:${dbAdminPassword}@${postgresqlServerName}.postgres.database.azure.com:5432/${projectName}_db?sslmode=require'
    CORS_ORIGINS: 'https://${webAppName}.azurewebsites.net'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~4'
  }
}

// PostgreSQL Server
resource postgresqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: postgresqlServerName
  location: location
  sku: {
    name: dbSkuName
    tier: 'Burstable'
  }
  properties: {
    createMode: 'Default'
    administratorLogin: dbAdminUsername
    administratorLoginPassword: dbAdminPassword
    version: '15'
    availabilityZone: '1'
    storage: {
      storageSizeGB: dbStorageSizeGB
    }
    backup: {
      backupRetentionDays: dbBackupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// PostgreSQL 데이터베이스
resource postgresqlDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresqlServer
  name: '${projectName}_db'
}

// PostgreSQL 방화벽 규칙 - Azure 서비스 허용
resource postgresqlFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresqlServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// 웹 앱 배포 슬롯 설정
resource webAppDeploymentSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: webApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
  }
}

// API 앱 배포 슬롯 설정
resource apiAppDeploymentSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: apiApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
  }
}

// ===================================================================
// 출력값
// ===================================================================
output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output apiAppName string = apiApp.name
output apiAppUrl string = 'https://${apiApp.properties.defaultHostName}'
output apiConnectionString string = 'https://${apiAppName}.azurewebsites.net/api/v1'
output postgresqlServerFqdn string = postgresqlServer.properties.fullyQualifiedDomainName
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
