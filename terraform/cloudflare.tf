variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

# Create Cloudflare zone for each domain
resource "cloudflare_zone" "domain" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  zone       = each.key  # This is the root domain (e.g., leetrepeat.com)
  type       = "full"
}

# Create DNS records for each domain
resource "cloudflare_record" "pages_cname" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "@"  # Use @ to represent the root domain
  content = "${each.value.repo_name}.pages.dev"
  type    = "CNAME"
  proxied = true
  allow_overwrite = true
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = each.value.repo_name
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source {
    type = "github"
    config {
      owner = "matty271828"
      repo_name = each.value.repo_name
      production_branch = "main"
    }
  }

deployment_configs {
    preview {
      d1_databases = {
        TEST_DB = cloudflare_d1_database.domain_db[each.key].id
      }
    }
    production {
      d1_databases = {
        PROD_DB = cloudflare_d1_database.domain_db[each.key].id
      }
    }
  }
}

# Create D1 databases for each domain
resource "cloudflare_d1_database" "domain_db" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = "${each.value.repo_name}-db"
}

# Create the shared auth service worker
resource "cloudflare_workers_script" "auth_service" {
  account_id = var.cloudflare_account_id
  name       = "auth-service"
  content    = file("${path.module}/../auth-service/dist/worker.js")
}

# Create worker routes for each domain to direct /auth/* traffic to the worker
resource "cloudflare_workers_route" "auth_route" {
  for_each = local.frontend_repos

  zone_id     = cloudflare_zone.domain[each.key].id
  pattern     = "${each.key}/auth/*"
  script      = "auth-service"

  depends_on = [cloudflare_workers_script.auth_service]
}