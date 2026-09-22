class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, code: str = "NOT_FOUND", message: str = "العنصر غير موجود."):
        super().__init__(code, message, 404)


class ForbiddenError(AppError):
    def __init__(self, message: str = "ليس لديك صلاحية لتنفيذ هذا الإجراء."):
        super().__init__("FORBIDDEN", message, 403)
