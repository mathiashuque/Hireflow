using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hireflow.Api.Errors;

/// <summary>
/// Canonical problem-response construction for controllers, so every hand-built error
/// carries the same <c>code</c> extension shape instead of controllers subtly diverging.
/// <see cref="Program" />'s <c>CustomizeProblemDetails</c> callback fills in <c>type</c>
/// and <c>traceId</c> afterward; it never overrides a code set here.
/// </summary>
public static class ProblemResultExtensions
{
    /// <summary>A problem response with a stable machine-readable <paramref name="code" />.</summary>
    public static ObjectResult ProblemWithCode(
        this ControllerBase controller,
        int statusCode,
        string code,
        string? title = null,
        string? detail = null)
    {
        // Not passed through Problem()'s own `extensions` parameter: ProblemDetailsFactory
        // already runs CustomizeProblemDetails (which fills a fallback "code") before that
        // parameter is merged in via a plain Add, so passing "code" there throws on the
        // resulting duplicate key. Setting it afterward via the indexer overwrites cleanly.
        var result = controller.Problem(detail: detail, statusCode: statusCode, title: title);
        if (result is ObjectResult { Value: ProblemDetails problemDetails })
        {
            problemDetails.Extensions[HireflowProblemDetailsOptions.CodeExtensionKey] = code;
        }

        return result;
    }

    /// <summary>A validation problem response, tagged with the general <see cref="ProblemCodes.ValidationError" /> code.</summary>
    public static ActionResult ValidationProblemWithCode(this ControllerBase controller, ModelStateDictionary modelState)
    {
        var result = controller.ValidationProblem(modelState);
        if (result is ObjectResult { Value: ProblemDetails problemDetails })
        {
            problemDetails.Extensions["code"] = ProblemCodes.ValidationError;
        }

        return result;
    }

    public static ModelStateDictionary ToModelState(string key, IReadOnlyList<string> errors)
    {
        var modelState = new ModelStateDictionary();
        foreach (var error in errors)
        {
            modelState.AddModelError(key, error);
        }

        return modelState;
    }
}
