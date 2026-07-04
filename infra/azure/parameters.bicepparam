// ===================================================================
// MenuPick Application - Azure Parameters
// ===================================================================
// Korea Central 지역에 배포하기 위한 매개변수 설정

param location = 'koreacentral'
param environment = 'prod'
param projectName = 'menupick'
param uniqueSuffix = ''

// 데이터베이스 관리자 비밀번호
// 프로덕션 환경에서는 Azure Key Vault에서 주입됨
param dbAdminPassword = ''

// PostgreSQL 설정
param dbSkuName = 'Standard_B1ms'
param dbStorageSizeGB = 32
param dbBackupRetentionDays = 7

// App Service Plan 설정 (B1 = 기본 단계, 가장 저렴함)
param appServiceSkuName = 'B1'
param appServiceSkuTier = 'Basic'
