# AWS SES Configuration for Email Service
# This file configures SES for sending and receiving emails for each custom domain

# Create SES domain identities for each domain
resource "aws_ses_domain_identity" "domain" {
  for_each = local.frontend_repos

  domain = each.key
}

# Create SES domain DKIM for each domain
resource "aws_ses_domain_dkim" "domain" {
  for_each = local.frontend_repos

  domain = aws_ses_domain_identity.domain[each.key].domain
}

# Create SES domain mail from for each domain
resource "aws_ses_domain_mail_from" "domain" {
  for_each = local.frontend_repos

  domain           = aws_ses_domain_identity.domain[each.key].domain
  mail_from_domain = "mail.${each.key}"
}

# Create DNS records for SES verification and DKIM
resource "cloudflare_dns_record" "ses_verification" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "_amazonses.${each.key}"
  content = "\"${aws_ses_domain_identity.domain[each.key].verification_token}\""
  type    = "TXT"
  ttl     = 1
}

resource "cloudflare_dns_record" "ses_dkim" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[0]}._domainkey.${each.key}"
  content = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[0]}.dkim.amazonses.com"
  type    = "CNAME"
  ttl     = 1
}

resource "cloudflare_dns_record" "ses_dkim_2" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[1]}._domainkey.${each.key}"
  content = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[1]}.dkim.amazonses.com"
  type    = "CNAME"
  ttl     = 1
}

resource "cloudflare_dns_record" "ses_dkim_3" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[2]}._domainkey.${each.key}"
  content = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[2]}.dkim.amazonses.com"
  type    = "CNAME"
  ttl     = 1
}

# Create MX record for receiving emails
resource "cloudflare_dns_record" "ses_mx" {
  for_each = local.frontend_repos

  zone_id  = cloudflare_zone.domain[each.key].id
  name     = each.key
  content  = "inbound-smtp.${var.aws_region}.amazonaws.com"
  type     = "MX"
  priority = 10
  ttl      = 1
}

# Create SPF record for email authentication
resource "cloudflare_dns_record" "ses_spf" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = each.key
  content = "\"v=spf1 include:amazonses.com ~all\""
  type    = "TXT"
  ttl     = 1
}

# Create DMARC record for email authentication
resource "cloudflare_dns_record" "ses_dmarc" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "_dmarc.${each.key}"
  content = "\"v=DMARC1; p=quarantine; rua=mailto:${var.gmail_address}\""
  type    = "TXT"
  ttl     = 1
}

# Output SES domain identities for use in other resources
output "ses_domain_identities" {
  description = "The SES domain identities for each domain"
  value = {
    for key, identity in aws_ses_domain_identity.domain : key => {
      domain = identity.domain
      arn    = identity.arn
    }
  }
  sensitive = true
}

# Create SES receipt rules for each domain to handle incoming emails
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "main-receipt-rule-set"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

resource "aws_ses_receipt_rule" "store" {
  for_each = local.frontend_repos

  name          = "forward-support-${each.key}"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = ["support@${each.key}"]
  enabled       = true
  scan_enabled  = true

  add_header_action {
    header_name  = "X-Forwarded-For"
    header_value = "support@${each.key}"
  }

  sns_action {
    topic_arn = aws_sns_topic.email_forwarding[each.key].arn
  }

  depends_on = [aws_ses_active_receipt_rule_set.main]
}

# Create SNS topics for email forwarding
resource "aws_sns_topic" "email_forwarding" {
  for_each = local.frontend_repos

  name = "email-forwarding-${each.key}"
}

# Create SNS topic subscriptions to forward to Gmail
resource "aws_sns_topic_subscription" "email_forwarding" {
  for_each = local.frontend_repos

  topic_arn = aws_sns_topic.email_forwarding[each.key].arn
  protocol  = "email"
  endpoint  = var.gmail_address # You'll need to add this variable
}

# Configure SES for sending emails
resource "aws_ses_configuration_set" "main" {
  name = "main-configuration-set"
}

# Create IAM user for SES API access
resource "aws_iam_user" "ses_user" {
  name = "ses-email-user"
}

resource "aws_iam_access_key" "ses_user" {
  user = aws_iam_user.ses_user.name
}

# Attach SES sending policy to the user
resource "aws_iam_user_policy" "ses_sending_policy" {
  name = "ses-sending-policy"
  user = aws_iam_user.ses_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Output the SES user credentials for use in the auth service
output "ses_user_credentials" {
  description = "SES user credentials for sending emails"
  value = {
    access_key_id = aws_iam_access_key.ses_user.id
    secret_access_key = aws_iam_access_key.ses_user.secret
  }
  sensitive = true
} 