namespace Hireflow.Tests.Integration;

/// <summary>
/// A minimal cookie jar for <see cref="HttpClient" /> instances created by
/// <c>WebApplicationFactory</c>, so tests can both replay cookies across requests and
/// read individual cookie values (e.g. the CSRF request token) to build follow-up
/// requests, which <see cref="HttpClientHandler.UseCookies" /> does not expose.
/// </summary>
public sealed class CookieCapturingHandler : DelegatingHandler
{
    private readonly Dictionary<string, string> _cookies = new(StringComparer.Ordinal);

    public IReadOnlyDictionary<string, string> Cookies => _cookies;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        if (_cookies.Count > 0)
        {
            request.Headers.Remove("Cookie");
            request.Headers.Add("Cookie", string.Join("; ", _cookies.Select(pair => $"{pair.Key}={pair.Value}")));
        }

        var response = await base.SendAsync(request, cancellationToken);

        if (response.Headers.TryGetValues("Set-Cookie", out var setCookieHeaders))
        {
            foreach (var setCookie in setCookieHeaders)
            {
                var namePair = setCookie.Split(';', 2)[0];
                var separatorIndex = namePair.IndexOf('=');
                if (separatorIndex <= 0)
                {
                    continue;
                }

                var name = namePair[..separatorIndex];
                var value = namePair[(separatorIndex + 1)..];
                _cookies[name] = value;
            }
        }

        return response;
    }
}
