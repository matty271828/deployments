# Cloudflare Zones - One for each domain
resource "cloudflare_zone" "domains" {
  for_each = toset([var.domain])  # This will add new domains without affecting existing ones
  account_id = var.cloudflare_account_id
  zone       = each.value
}

# A Records for root domains - One for each domain
resource "cloudflare_record" "root" {
  for_each = cloudflare_zone.domains
  zone_id = each.value.id
  name    = "@"
  content = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
}

# CNAME Records for www subdomains - One for each domain
resource "cloudflare_record" "www" {
  for_each = cloudflare_zone.domains
  zone_id = each.value.id
  name    = "www"
  content = each.value.zone
  type    = "CNAME"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
} 