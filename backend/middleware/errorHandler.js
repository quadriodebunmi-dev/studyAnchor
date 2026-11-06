export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  // Multer's own errors (file too big, too many files…) are the client's fault, not a 500.
  if (err?.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({
      message: tooBig ? "That file is too large to upload this way. Refresh the page and try again." : "That upload wasn't accepted. Check the files and try again.",
    });
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Something went wrong. Please try again.",
  });
}
