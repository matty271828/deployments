resource "cloudflare_zone" "domains" {
  for_each = toset([var.domain])
  account_id = var.cloudflare_account_id
  zone       = each.value
} 