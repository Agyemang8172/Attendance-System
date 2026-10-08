import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Attendance System API",
      version: "1.0.0",
      description: `
# Attendance System API

RESTful API for employee attendance management with role-based access control.

## Authentication
All endpoints (except \`/auth/login\`) require a **Bearer token** in the Authorization header:
\`\`\`
Authorization: Bearer <JWT_TOKEN>
\`\`\`

## Roles
- **SUPERADMIN**: Full system access, user management
- **HR**: View all attendance, manage staff
- **STAFF**: Personal attendance (clock in/out, view own records)

## Rate Limiting
- General API: 100 requests / 15 minutes per IP
- Login: 10 requests / 15 minutes per IP

## Error Format
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "email", "message": "Invalid email format" }]
}
\`\`\`
      `,
      contact: {
        name: "Attendance System",
      },
    },
    servers: [
      {
        url: "http://localhost:8000/api",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // Auth
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "user@company.com" },
            password: { type: "string", format: "password", example: "password123" },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            token: { type: "string" },
            user: { $ref: "#/components/schemas/AuthUser" },
          },
        },
        AuthUser: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            role: { type: "string", enum: ["STAFF", "HR", "SUPERADMIN"] },
            mustChangePassword: { type: "boolean" },
            employeeCode: { type: "string" },
            department: { type: "string" },
          },
        },
        // Users
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            employeeCode: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phoneNumber: { type: "string" },
            role: { type: "string", enum: ["STAFF", "HR", "SUPERADMIN"] },
            department: { type: "string" },
            jobTitle: { type: "string" },
            isActive: { type: "boolean" },
            mustChangePassword: { type: "boolean" },
            shiftId: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateUserRequest: {
          type: "object",
          required: ["firstName", "lastName", "email", "department"],
          properties: {
            firstName: { type: "string", maxLength: 100 },
            lastName: { type: "string", maxLength: 100 },
            email: { type: "string", format: "email" },
            department: { type: "string", maxLength: 100 },
            role: { type: "string", enum: ["STAFF", "HR", "SUPERADMIN"], default: "STAFF" },
            phoneNumber: { type: "string", maxLength: 20 },
            jobTitle: { type: "string", maxLength: 100 },
            shiftId: { type: "string", format: "uuid" },
          },
        },
        UpdateUserRequest: {
          type: "object",
          properties: {
            firstName: { type: "string", maxLength: 100 },
            lastName: { type: "string", maxLength: 100 },
            email: { type: "string", format: "email" },
            department: { type: "string", maxLength: 100 },
            role: { type: "string", enum: ["STAFF", "HR", "SUPERADMIN"] },
            phoneNumber: { type: "string", maxLength: 20 },
            jobTitle: { type: "string", maxLength: 100 },
            shiftId: { type: "string", format: "uuid" },
            isActive: { type: "boolean" },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1 },
            newPassword: { type: "string", minLength: 8 },
          },
        },
        UsersResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "array", items: { $ref: "#/components/schemas/User" } },
            pagination: { $ref: "#/components/schemas/Pagination" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            currentPage: { type: "integer" },
            totalPages: { type: "integer" },
            totalUsers: { type: "integer" },
          },
        },
        // Attendance
        AttendanceRecord: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                employeeCode: { type: "string" },
                department: { type: "string" },
                role: { type: "string" },
              },
            },
            clockIn: { type: "string", format: "date-time" },
            clockOut: { type: "string", format: "date-time", nullable: true },
            date: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"] },
            sessionStatus: { type: "string", enum: ["OPEN", "CLOSED"] },
            hoursWorked: { type: "number" },
            checkInIp: { type: "string" },
            checkInLat: { type: "number" },
            checkInLng: { type: "number" },
            remarks: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ClockInRequest: {
          type: "object",
          properties: {
            checkInIp: { type: "string", format: "ipv4" },
            checkInLat: { type: "number", minimum: -90, maximum: 90 },
            checkInLng: { type: "number", minimum: -180, maximum: 180 },
            remarks: { type: "string", maxLength: 500 },
          },
        },
        ClockOutRequest: {
          type: "object",
          properties: {
            remarks: { type: "string", maxLength: 500 },
          },
        },
        AttendanceListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            count: { type: "integer" },
            total: { type: "integer" },
            page: { type: "integer" },
            data: { type: "array", items: { $ref: "#/components/schemas/AttendanceRecord" } },
          },
        },
        // Errors
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        ValidationErrorResponse: {
          allOf: [
            { $ref: "#/components/schemas/ErrorResponse" },
            {
              type: "object",
              properties: {
                errors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Authentication", description: "Login and password management" },
      { name: "Users", description: "User management (SUPERADMIN/HR)" },
      { name: "Attendance", description: "Clock in/out and attendance records" },
      { name: "Health", description: "System health checks" },
    ],
  },
  apis: ["./routes/*.ts", "./controllers/*.ts"], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #eab308; }
      `,
      customSiteTitle: "Attendance System API Docs",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );

  // Raw OpenAPI spec
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
};

export default setupSwagger;