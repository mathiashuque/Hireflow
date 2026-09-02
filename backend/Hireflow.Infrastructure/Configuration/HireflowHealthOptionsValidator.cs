using Hireflow.Infrastructure.Health;
using Microsoft.Extensions.Options;

namespace Hireflow.Infrastructure.Configuration;

/// <summary>Fails startup with a clear, non-secret message rather than silently accepting a nonsensical health-check timeout.</summary>
public sealed class HireflowHealthOptionsValidator : IValidateOptions<HireflowHealthOptions>
{
    public ValidateOptionsResult Validate(string? name, HireflowHealthOptions options) =>
        options.DatabaseTimeoutSeconds > 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(
                $"{HireflowHealthOptions.SectionName}:{nameof(HireflowHealthOptions.DatabaseTimeoutSeconds)} must be a positive number of seconds.");
}
