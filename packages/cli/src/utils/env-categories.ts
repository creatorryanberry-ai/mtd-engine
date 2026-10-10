import pc from 'picocolors'

import type { EnvVariable, EnvCategory } from '../types'

export const envCategories: EnvCategory[] = [
  {
    id: 'core',
    name: 'Core Configuration',
    description: 'Essential configuration for your production deployment',
    required: true,
    variables: [
      {
        key: 'BETTER_AUTH_SECRET',
        label: 'Authentication Secret',
        description: 'Secret key for session encryption and JWT signing',
        instructions: `Generate a secure random key:\n${pc.cyan('openssl rand -hex 32')}`,
        required: true,
        type: 'secret',
        generator: () => {
          const crypto = require('node:crypto')
          return crypto.randomBytes(32).toString('hex')
        },
      },
      {
        key: 'BETTER_AUTH_URL',
        label: 'Authentication URL',
        description: 'The public URL where your app will be hosted',
        instructions: 'Enter your production domain (e.g., https://your-app.com)',
        required: true,
        type: 'text',
        placeholder: 'https://your-app.com',
      },
      {
        key: 'ONE_SERVER_URL',
        label: 'Server URL',
        description: 'The URL for your main server',
        instructions: 'Usually the same as your authentication URL',
        required: true,
        type: 'text',
        placeholder: 'https://your-app.com',
      },
      {
        key: 'VITE_WEB_HOSTNAME',
        label: 'Web App Hostname',
        description: 'Public hostname for the web app',
        instructions:
          'Just the hostname, e.g., app.your-app.com (https:// assumed in production)',
        required: true,
        type: 'text',
        placeholder: 'app.your-app.com',
      },
    ],
  },
  {
    id: 'database',
    name: 'Database (PostgreSQL)',
    description:
      'Production database configuration - set by deployment platform (SST/uncloud)',
    required: false,
    variables: [
      // Note: DATABASE_URL is set dynamically by the deployment platform (uncloud)
    ],
  },
  {
    id: 'storage',
    name: 'File Storage (GCS)',
    description: 'Private receipt storage on Google Cloud; MinIO locally',
    required: false,
    variables: [
      {
        key: 'GCS_RECEIPTS_BUCKET',
        label: 'GCS Receipts Bucket',
        description: 'Private Google Cloud Storage bucket for receipt images',
        instructions:
          'Create a private bucket (no public access). Required for staging/production. Leave empty locally to use MinIO.',
        required: false,
        type: 'text',
        placeholder: 'straightuptax-receipts',
      },
      {
        key: 'GCS_PROJECT_ID',
        label: 'GCS Project ID',
        description: 'Optional GCP project id (defaults from the service account JSON)',
        instructions: 'Leave blank unless the service account JSON omits project_id',
        required: false,
        type: 'text',
      },
      {
        key: 'GCS_SERVICE_ACCOUNT_JSON',
        label: 'GCS Service Account JSON',
        description:
          'Service account key JSON for private receipt uploads and signed URLs',
        instructions:
          'Paste the full JSON key for a service account with objectAdmin on the receipts bucket',
        required: false,
        type: 'secret',
      },
      {
        key: 'ADMIN_EMAILS',
        label: 'Admin Email Allowlist',
        description: 'Comma-separated emails treated as admin in addition to role=admin',
        instructions: 'Example: ops@straightup.tax,security@straightup.tax',
        required: false,
        type: 'text',
        placeholder: 'ops@straightup.tax',
      },
    ],
  },
  {
    id: 'apple',
    name: 'Apple App Store',
    description: 'Configuration for iOS app and push notifications',
    required: false,
    variables: [
      {
        key: 'APNS_TEAM_ID',
        label: 'Apple Team ID',
        description: 'Your Apple Developer Team ID',
        instructions: `Find in Apple Developer Portal:\n1. Go to ${pc.cyan('https://developer.apple.com/account')}\n2. Look for "Team ID" in Membership Details`,
        required: false,
        type: 'text',
        placeholder: 'XXXXXXXXXX',
      },
      {
        key: 'APNS_KEY_ID',
        label: 'APNs Key ID',
        description: 'Push notification authentication key ID',
        instructions: `Create in Apple Developer Portal:\n1. Go to Certificates, Identifiers & Profiles\n2. Keys → Create a Key\n3. Check "Apple Push Notifications service (APNs)"\n4. Download the .p8 file and note the Key ID`,
        required: false,
        type: 'text',
        placeholder: 'XXXXXXXXXX',
      },
      {
        key: 'APNS_KEY',
        label: 'APNs Key Content',
        description: 'Contents of your APNs .p8 key file',
        instructions: 'Paste the entire contents of the .p8 file you downloaded',
        required: false,
        type: 'multiline',
      },
      {
        key: 'APNS_ENDPOINT',
        label: 'APNs Endpoint',
        description: 'Apple Push Notification service endpoint',
        instructions: `Production: ${pc.green('https://api.push.apple.com')}\nSandbox: ${pc.yellow('https://api.sandbox.push.apple.com')}`,
        required: false,
        type: 'text',
        default: 'https://api.push.apple.com',
      },
    ],
  },
  {
    id: 'email',
    name: 'Email Service',
    description: 'Transactional email configuration',
    required: false,
    variables: [
      {
        key: 'POSTMARK_SERVER_TOKEN',
        label: 'Postmark Server Token',
        description: 'API token for sending emails via Postmark',
        instructions: `Get your token:\n1. Sign up at ${pc.cyan('https://postmarkapp.com')}\n2. Create a Server\n3. Go to Servers → API Tokens\n4. Copy your Server API Token\n\n${pc.yellow('Note: Free tier includes 100 emails/month')}`,
        required: false,
        type: 'text',
      },
      {
        key: 'POSTMARK_FROM_EMAIL',
        label: 'Postmark From Email',
        description: 'Verified sender address for transactional email',
        instructions: `Must be a verified sender in Postmark. Use a product mailbox such as ${pc.cyan('hello@yourdomain.com')}, not a personal address or noreply@.`,
        required: false,
        type: 'text',
        default: 'hello@straightup.tax',
      },
      {
        key: 'INBOUND_EMAIL_DOMAIN',
        label: 'Inbound Email Domain',
        description:
          'Domain for unique per-account inbound addresses (MX must point at Postmark)',
        instructions: `Create an inbound domain in Postmark and point MX records at Postmark. The webhook URL is ${pc.cyan('POST /api/inbound-email/postmark')} on the api host.`,
        required: false,
        type: 'text',
        default: 'inbox.straightup.tax',
      },
      {
        key: 'POSTMARK_INBOUND_WEBHOOK_USER',
        label: 'Postmark Inbound Webhook User',
        description: 'HTTP Basic username Postmark uses to call the inbound webhook',
        instructions:
          'Set this in Postmark → Server → Settings → Inbound → webhook HTTP auth. Use any username you choose.',
        required: false,
        type: 'text',
      },
      {
        key: 'POSTMARK_INBOUND_WEBHOOK_PASSWORD',
        label: 'Postmark Inbound Webhook Password',
        description: 'HTTP Basic password Postmark uses to call the inbound webhook',
        instructions:
          'Must match the HTTP Basic password configured on the Postmark inbound webhook.',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub OAuth',
    description: 'Enable GitHub sign-in for your app',
    required: false,
    variables: [
      {
        key: 'ONECHAT_GITHUB_CLIENT_ID',
        label: 'GitHub OAuth Client ID',
        description: 'Client ID for GitHub OAuth application',
        instructions: `Create GitHub OAuth App:\n1. Go to ${pc.cyan('https://github.com/settings/developers')}\n2. New OAuth App\n3. Set Authorization callback URL:\n   ${pc.green('https://your-app.com/api/auth/callback/github')}\n4. Copy the Client ID`,
        required: false,
        type: 'text',
      },
      {
        key: 'ONECHAT_GITHUB_CLIENT_SECRET',
        label: 'GitHub OAuth Client Secret',
        description: 'Client secret for GitHub OAuth application',
        instructions: 'Copy the Client Secret from your GitHub OAuth App settings',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'aws',
    name: 'AWS Deployment',
    description: 'AWS credentials for SST deployment',
    required: false,
    setupTime: '~30 minutes',
    variables: [
      {
        key: 'AWS_ACCESS_KEY_ID',
        label: 'AWS Access Key ID',
        description: 'Access key for AWS deployment',
        instructions: `${pc.yellow('⚠️  Setting up AWS takes about 30 minutes')}\n\nFollow the SST guide for AWS setup:\n${pc.cyan('https://sst.dev/docs/aws-accounts/')}\n\nQuick steps:\n1. Create AWS account or use existing\n2. Create IAM user with AdministratorAccess\n3. Generate access keys\n4. Copy Access Key ID`,
        required: false,
        type: 'text',
      },
      {
        key: 'AWS_SECRET_ACCESS_KEY',
        label: 'AWS Secret Access Key',
        description: 'Secret key for AWS deployment',
        instructions: 'Copy the Secret Access Key from IAM user creation',
        required: false,
        type: 'secret',
      },
      {
        key: 'AWS_REGION',
        label: 'AWS Region',
        description: 'AWS region for deployment',
        instructions:
          'Choose a region close to your users (e.g., us-west-1, us-east-1, eu-west-1)',
        required: false,
        type: 'text',
        default: 'us-west-1',
        placeholder: 'us-west-1',
      },
    ],
  },
]

export function getCategoryById(id: string): EnvCategory | undefined {
  return envCategories.find((cat) => cat.id === id)
}

export function getRequiredCategories(): EnvCategory[] {
  return envCategories.filter((cat) => cat.required)
}

export function getOptionalCategories(): EnvCategory[] {
  return envCategories.filter((cat) => !cat.required)
}

export function getAllVariables(): EnvVariable[] {
  return envCategories.flatMap((cat) => cat.variables)
}

export function getVariableByKey(key: string): EnvVariable | undefined {
  return getAllVariables().find((v) => v.key === key)
}
