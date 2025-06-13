# Read domains from file
data "local_file" "domains" {
  filename = "${path.module}/../domains.txt"
}

locals {
  # Split by newline, trim whitespace, and filter out empty strings and comments
  raw_domains = [for domain in split("\n", data.local_file.domains.content) : trimspace(domain) if trimspace(domain) != "" && !startswith(trimspace(domain), "#")]
  
  # Parse the domains JSON from GitHub Actions output
  domains = jsondecode(var.domains_json)
  
  # Create a map of domains for easier iteration
  domain_map = {
    for domain in local.domains : domain.domain => domain
  }
}

# Output the list of domains for future reference
output "domains" {
  value = local.domains
}

output "current_domain" {
  value = var.domain
  description = "The domain being added in this run"
}

# Cloudflare Zone for each domain
resource "cloudflare_zone" "domains" {
  for_each = local.domain_map
  
  zone = each.value.domain
  account_id = var.cloudflare_account_id
}

# DNS Records for each domain
resource "cloudflare_record" "domains" {
  for_each = local.domain_map
  
  zone_id = cloudflare_zone.domains[each.key].id
  name    = each.value.domain
  value   = "cname.vercel-dns.com"  # Adjust this based on your deployment target
  type    = "CNAME"
  proxied = true
}

# Output the zone IDs for reference
output "zone_ids" {
  value = {
    for domain, zone in cloudflare_zone.domains : domain => zone.id
  }
  description = "Map of domain names to their Cloudflare zone IDs"
}