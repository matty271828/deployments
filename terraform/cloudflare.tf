# Try to get existing zones
data "cloudflare_zone" "existing" {
  for_each = toset(local.domains)
  name     = each.value
}

locals {
  # Create a map of existing zones
  existing_zones = { for domain, zone in data.cloudflare_zone.existing : domain => { id = zone.id, zone = domain } }
  
  # Filter out domains that already have zones
  new_domains = [for domain in local.domains : domain if !contains(keys(local.existing_zones), domain)]
}

# Create zones only for new domains
resource "cloudflare_zone" "new" {
  for_each = toset(local.new_domains)
  account_id = var.cloudflare_account_id
  zone       = each.value
}

# Combine existing and new zones
locals {
  all_zones = merge(
    local.existing_zones,
    { for domain, zone in cloudflare_zone.new : domain => { id = zone.id, zone = domain } }
  )
}

# A Records for domains
resource "cloudflare_record" "root" {
  for_each = local.all_zones
  zone_id = each.value.id
  name    = "@"
  content = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
  allow_overwrite = true  # Allow overwriting existing records
}

# CNAME Records for domains
resource "cloudflare_record" "www" {
  for_each = local.all_zones
  zone_id = each.value.id
  name    = "www"
  content = each.value.zone
  type    = "CNAME"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
  allow_overwrite = true  # Allow overwriting existing records
}