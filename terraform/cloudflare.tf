variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

# Create Cloudflare zone for each domain
resource "cloudflare_zone" "domain" {
  for_each = local.frontend_repos

  name = each.key
  account = {
    id = var.cloudflare_account_id
  }
  type       = "full"
}

# Create DNS records for each domain
resource "cloudflare_dns_record" "pages_cname" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "@"  # Use @ to represent the root domain
  content = "${each.value.repo_name}.pages.dev"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = each.value.repo_name
  production_branch = "main"
  
  build_config = {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source = {
    type = "github"
    config = {
      owner = "matty271828"
      repo_name = each.value.repo_name
      production_branch = "main"
    }
  }

  deployment_configs = {
    production = {
      d1_databases = {
        D1_BINDING = {
          id = cloudflare_d1_database.domain_db[each.key].id
        }
      }
    }
  }

  depends_on = [cloudflare_d1_database.domain_db]
}