import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

type ValidationSchemas = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

const parseErrors = (error: ZodError) =>
  error.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: parseErrors(result.error),
          });
          return;
        }
        req.body = result.data as any;
      }

      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          res.status(400).json({
            success: false,
            message: "Invalid query parameters",
            errors: parseErrors(result.error),
          });
          return;
        }
        Object.assign(req.query, result.data);
      }

      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          res.status(400).json({
            success: false,
            message: "Invalid parameters",
            errors: parseErrors(result.error),
          });
          return;
        }
        Object.assign(req.params, result.data);
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Validation error",
      });
    }
  };
};