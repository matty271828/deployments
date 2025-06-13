# Try to get existing zones
data "cloudflare_zone" "existing" {
  for_each = toset([for domain in local.domains : domain.domain])
  name     = each.value
}

locals {
  # Parse the domains JSON from GitHub Actions output
  domains = jsondecode(var.domains_json)
  
  # Create a map of frontend repos
  frontend_repos = { for domain in local.domains : domain.domain => domain.frontend_repo }
  
  # Create a map of existing zones
  existing_zones = { for domain, zone in data.cloudflare_zone.existing : domain => { id = zone.id, zone = domain } }
  
  # Filter out domains that already have zones
  new_domains = [for domain in local.domains : domain.domain if !contains(keys(local.existing_zones), domain.domain)]
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