# Cloudflare Zone for each domain
resource "cloudflare_zone" "domains" {
  for_each = { for domain in local.domains : domain.domain => domain }
  
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
  value = { for domain, zone in cloudflare_zone.domains : domain => zone.id }
  description = "Map of domain names to their Cloudflare zone IDs"
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.frontend_repos
  account_id = var.cloudflare_account_id
  name       = replace(each.value, "/[^a-zA-Z0-9-]/", "-")
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    build_output_dir = "dist"
    node_version = "20"
  }

  source {
    type = "github"
    config {
      owner = split("/", split("github.com/", each.value)[1])[0]
      repo_name = split("/", split("github.com/", each.value)[1])[1]
      production_branch = "main"
    }
  }
}

# Create custom domains for Pages projects
resource "cloudflare_pages_domain" "custom_domain" {
  for_each = local.frontend_repos
  account_id = var.cloudflare_account_id
  project_name = replace(each.value, "/[^a-zA-Z0-9-]/", "-")
  domain = each.key
}