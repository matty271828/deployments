data "digitalocean_ssh_key" "my_ssh_key" {
  name = var.digital_ocean_ssh_key_name
}

# Get existing project
data "digitalocean_project" "serverless" {
  name = "multi-project"
}

# Create project only if it doesn't exist
resource "digitalocean_project" "serverless" {
  count       = data.digitalocean_project.serverless.id == "" ? 1 : 0
  name        = "multi-project"
  description = "Project for multi-project server"
  purpose     = "Web Application"
  environment = "Production"
}

locals {
  project_id = data.digitalocean_project.serverless.id != "" ? data.digitalocean_project.serverless.id : digitalocean_project.serverless[0].id
}

resource "digitalocean_droplet" "multi-project-server" {
  count = 1
  image  = "ubuntu-24-10-x64"
  name   = "multi-project-server-001"
  region = "lon1"
  size   = "s-1vcpu-1gb-35gb-intel"
  ssh_keys = [data.digitalocean_ssh_key.my_ssh_key.id]
}

resource "digitalocean_project_resources" "project_resources" {
  project = local.project_id
  resources = [digitalocean_droplet.multi-project-server[0].urn]
} 