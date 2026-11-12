"""Traduce los errores de Terraform, Pulumi y AWS a mensajes que entiende cualquiera."""

import re


class ErrorOperacion(Exception):
    """Error ya explicado en español, listo para mostrar."""


PATRONES: list[tuple[str, str]] = [
    (
        r"ExpiredToken|InvalidClientTokenId|SignatureDoesNotMatch|NoCredentialProviders|"
        r"no valid credential sources|UnrecognizedClientException",
        "Las credenciales de AWS no son válidas o vencieron. Revisa ~/.aws/credentials en la PC "
        "de la plataforma.",
    ),
    (
        r"allowed_account_ids|AWS account ID not allowed",
        "Las credenciales apuntan a otra cuenta de AWS distinta de la configurada.",
    ),
    (
        r"VcpuLimitExceeded|InstanceLimitExceeded",
        "La cuenta llegó a su límite de vCPU en la región. Elimina o suspende otros tenants o pide "
        "un aumento de cuota.",
    ),
    (
        r"InsufficientInstanceCapacity",
        "AWS no tiene capacidad para ese tipo de servidor en este momento. Reintenta en unos minutos.",
    ),
    (
        r"InvalidAMIID|Your query returned no results|no matching EC2 AMI",
        "No hay imagen de Presencia en esa región. Construye la AMI con Packer en la región elegida.",
    ),
    (
        r"AddressLimitExceeded",
        "La cuenta llegó al límite de IP elásticas (5 por región). Elimina un tenant que ya no uses.",
    ),
    (
        r"VpcLimitExceeded",
        "La cuenta llegó al límite de VPC (5 por región). Elimina un tenant que ya no uses.",
    ),
    (
        r"EntityAlreadyExists|AlreadyExists|DBInstanceAlreadyExists|already exists",
        "Ya existe en AWS un recurso con el nombre de este tenant que no pertenece a su estado. "
        "Elimínalo o usa otro identificador y reintenta: lo que ya se creó no se duplica.",
    ),
    (
        r"Error acquiring the state lock|ConditionalCheckFailed|PreconditionFailed|"
        r"the stack is currently locked",
        "Otra operación tiene bloqueado el estado de este tenant. Espera a que termine y reintenta.",
    ),
    (
        r"RequestLimitExceeded|Throttling",
        "AWS limitó la cantidad de pedidos por segundo. Reintenta en un minuto.",
    ),
    (
        r"timeout while waiting|context deadline exceeded|i/o timeout",
        "AWS tardó demasiado en responder. Reintenta la operación.",
    ),
]


def explicar(texto: str) -> str | None:
    for patron, mensaje in PATRONES:
        if re.search(patron, texto, re.IGNORECASE):
            return mensaje
    return None
