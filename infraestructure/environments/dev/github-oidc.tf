
# ==========================================
# GITHUB ACTIONS - OIDC
# ==========================================

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  tags = {
    Name = "${local.name_prefix}-github-oidc"
  }
}

# Permitir acceso unicamente desde main
# del repositorio autorizado.

data "aws_iam_policy_document" "github_trust" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.github.arn
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"

      values = [
        "repo:Aliaga23@${var.github_owner_id}/Diplo-Asistencia@${var.github_repo_id}:ref:refs/heads/main"
      ]
    }
  }
}

# Rol que utilizara GitHub Actions

resource "aws_iam_role" "github_deploy" {
  name = "${local.name_prefix}-github-deploy"

  assume_role_policy = (
    data.aws_iam_policy_document.github_trust.json
  )

  tags = {
    Name = "${local.name_prefix}-github-deploy"
  }
}

# ==========================================
# PERMISOS SSM PARA DESPLIEGUE
# ==========================================

data "aws_iam_policy_document" "github_ssm" {
  statement {
    sid    = "RunApprovedSSMDocument"
    effect = "Allow"

    actions = [
      "ssm:SendCommand"
    ]

    resources = [
      "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"
    ]
  }

  statement {
    sid    = "DeployOnlyToPresenciaInstances"
    effect = "Allow"

    actions = [
      "ssm:SendCommand"
    ]

    resources = [
      "arn:aws:ec2:${var.aws_region}:${var.expected_account_id}:instance/${module.frontend.instance_id}",
      "arn:aws:ec2:${var.aws_region}:${var.expected_account_id}:instance/${module.backend.instance_id}"
    ]
  }

  statement {
    sid    = "ReadDeploymentResults"
    effect = "Allow"

    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:ListCommands"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_ssm" {
  name = "${local.name_prefix}-github-ssm"

  role = aws_iam_role.github_deploy.id

  policy = data.aws_iam_policy_document.github_ssm.json
}

# ARN que utilizaremos en GitHub Actions

output "github_deploy_role_arn" {
  description = "Rol OIDC para desplegar desde GitHub."
  value       = aws_iam_role.github_deploy.arn
}
