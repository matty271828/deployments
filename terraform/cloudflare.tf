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
}

# Create D1 databases for each domain
resource "cloudflare_d1_database" "domain_db" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = "${each.value.repo_name}-db"
  read_replication = {
    mode = "disabled"
  }
}

# Create the shared auth service database
resource "cloudflare_d1_database" "AUTH_DB" {
  account_id = var.cloudflare_account_id
  name       = "AUTH_DB"
  read_replication = {
    mode = "disabled"
  }
}

# Create the shared auth service worker (intial no-op to ensure worker exists)
resource "cloudflare_workers_script" "auth_service" {
  account_id       = var.cloudflare_account_id
  script_name      = "auth-service"
  # Use addEventListener pattern for the no-op deployment. This is because there is a 
  # bug in the cloudflare terraform provider. We will have to output every created worker
  # and reupload an ES module worker using the API after our terraform run has completed.
  content          = "addEventListener('fetch', event => { event.respondWith(new Response('OK')) })"
}

# Create worker routes for each domain to direct /auth/* traffic to the worker
resource "cloudflare_workers_route" "auth_route" {
  for_each = local.frontend_repos

  zone_id     = cloudflare_zone.domain[each.key].id
  pattern     = "${each.key}/auth/*"
  script      = "auth-service"

  depends_on = [cloudflare_workers_script.auth_service]
}