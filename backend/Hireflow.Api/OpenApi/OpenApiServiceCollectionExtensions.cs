using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.OpenApi;
using AntiforgeryConstants = Hireflow.Api.Authentication.AntiforgeryServiceCollectionExtensions;
using AuthCookieConstants = Hireflow.Api.Authentication.AuthenticationServiceCollectionExtensions;

namespace Hireflow.Api.OpenApi;

/// <summary>
/// Configures the OpenAPI document for every controller endpoint: accurate operation
/// IDs/tags, the actual cookie authentication scheme (never a fictitious bearer/JWT
/// scheme), and the CSRF header every <c>[ValidateCsrfToken]</c> mutation requires.
/// </summary>
public static class OpenApiServiceCollectionExtensions
{
    public const string CookieSecuritySchemeId = "CookieAuth";

    private static readonly Dictionary<string, string> TagOverridesByController = new()
    {
        ["Health"] = "System",
        ["Auth"] = "Authentication",
        ["Invitations"] = "Invitations",
        ["WorkspaceInvitations"] = "Invitations",
        ["JobOpenings"] = "Jobs",
        ["JobCandidates"] = "Candidates",
        ["Candidates"] = "Candidates",
    };

    private static readonly HashSet<(string Controller, string Action)> MembersActions =
    [
        ("Workspaces", "GetMembers"),
        ("Workspaces", "ChangeMemberRole"),
        ("Workspaces", "RemoveMember"),
    ];

    public static IServiceCollection AddHireflowOpenApi(this IServiceCollection services)
    {
        services.AddOpenApi("v1", options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info = new OpenApiInfo
                {
                    Title = "Hireflow API",
                    Version = "v1",
                    Description =
                        "Hireflow is a multi-tenant hiring tracker. Every endpoint below is cookie-authenticated " +
                        "(see the CookieAuth security scheme) and every state-changing request additionally " +
                        "requires the CSRF header described on that scheme. A workspace, job, or candidate ID " +
                        "the caller cannot access returns the same 404 as a nonexistent one — existence is never " +
                        "observable across the tenant boundary.",
                };

                document.Components ??= new OpenApiComponents();
                document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
                document.Components.SecuritySchemes[CookieSecuritySchemeId] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.ApiKey,
                    In = ParameterLocation.Cookie,
                    Name = AuthCookieConstants.CookieName,
                    Description =
                        $"HTTP-only session cookie set by POST /api/auth/login or /api/auth/register. Not " +
                        "readable or settable from JavaScript/documentation tooling; sign in with a real " +
                        "cookie-aware client (browser or curl -c/-b) to exercise authenticated operations.",
                };

                return Task.CompletedTask;
            });

            options.AddOperationTransformer((operation, context, _) =>
            {
                var actionDescriptor = context.Description.ActionDescriptor as ControllerActionDescriptor;
                var controllerName = actionDescriptor?.ControllerName ?? "Default";
                var actionName = actionDescriptor?.ActionName ?? context.Description.ActionDescriptor.DisplayName ?? "Action";

                operation.OperationId = $"{controllerName}_{actionName}";
                operation.Tags = new HashSet<OpenApiTagReference> { new(ResolveTag(controllerName, actionName), null) };

                var endpointMetadata = context.Description.ActionDescriptor.EndpointMetadata;
                var isAnonymous = endpointMetadata.Any(m => m is Microsoft.AspNetCore.Authorization.IAllowAnonymous);
                var isAuthorized = !isAnonymous && endpointMetadata.Any(m => m is Microsoft.AspNetCore.Authorization.IAuthorizeData);

                if (isAuthorized)
                {
                    operation.Security =
                    [
                        new OpenApiSecurityRequirement
                        {
                            [new OpenApiSecuritySchemeReference(CookieSecuritySchemeId, null)] = [],
                        },
                    ];
                }

                var requiresCsrf = endpointMetadata.Any(m => m is Hireflow.Api.Authentication.ValidateCsrfTokenAttribute);
                if (requiresCsrf)
                {
                    operation.Parameters ??= [];
                    operation.Parameters.Add(new OpenApiParameter
                    {
                        Name = AntiforgeryConstants.HeaderName,
                        In = ParameterLocation.Header,
                        Required = true,
                        Description =
                            "The readable CSRF token issued by GET /api/auth/csrf as the XSRF-TOKEN cookie. " +
                            "Read that cookie and echo its value back in this header on every state-changing request.",
                        Schema = new OpenApiSchema { Type = JsonSchemaType.String },
                    });
                }

                return Task.CompletedTask;
            });
        });

        return services;
    }

    private static string ResolveTag(string controllerName, string actionName)
    {
        if (controllerName == "Workspaces" && MembersActions.Contains((controllerName, actionName)))
        {
            return "Members";
        }

        return TagOverridesByController.GetValueOrDefault(controllerName, controllerName switch
        {
            "Workspaces" => "Workspaces",
            _ => controllerName,
        });
    }
}
