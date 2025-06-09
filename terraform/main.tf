resource "cloudflare_zone" "domains" {
  for_each   = var.domains
  account_id = var.cloudflare_account_id
  zone       = each.value.name
} 