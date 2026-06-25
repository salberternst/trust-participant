export function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 500
  if (status >= 500) console.error(error)
  res.status(status).json({
    error: error.message ?? 'Internal server error',
    details: error.details,
  })
}
