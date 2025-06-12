# Get existing zones for domains
data "cloudflare_zone" "domains" {
  for_each = toset(local.domains)
  name     = each.value
}

locals {
  # Create a map of domain to zone_id for existing zones
  existing_zones = { for domain, zone in data.cloudflare_zone.domains : domain => { id = zone.id, zone = domain } }
}

# A Records for domains
resource "cloudflare_record" "root" {
  for_each = local.existing_zones
  zone_id = each.value.id
  name    = "@"
  content = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
  allow_overwrite = true  # Allow overwriting existing records
}

# CNAME Records for domains
resource "cloudflare_record" "www" {
  for_each = local.existing_zones
  zone_id = each.value.id
  name    = "www"
  content = each.value.zone
  type    = "CNAME"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
  allow_overwrite = true  # Allow overwriting existing records
}