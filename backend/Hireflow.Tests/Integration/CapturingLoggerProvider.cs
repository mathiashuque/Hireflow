using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Hireflow.Tests.Integration;

public sealed record CapturedLogEntry(LogLevel Level, string Category, string Message, IReadOnlyList<string> ScopeText);

/// <summary>Captures every log line (including its active scopes' rendered text) so a test can assert on content/PII/token exposure.</summary>
public sealed class CapturingLoggerProvider : ILoggerProvider
{
    public ConcurrentQueue<CapturedLogEntry> Entries { get; } = new();

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, Entries);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger(string category, ConcurrentQueue<CapturedLogEntry> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => ScopeStack.Push(state);

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            var message = formatter(state, exception) + (exception is null ? "" : $" | {exception}");
            entries.Enqueue(new CapturedLogEntry(logLevel, category, message, ScopeStack.RenderAll()));
        }
    }

    /// <summary>An async-local scope stack so nested `BeginScope` calls on the same logical request are captured together.</summary>
    private static class ScopeStack
    {
        private static readonly AsyncLocal<ImmutableScopeNode?> Current = new();

        public static IDisposable Push(object? state)
        {
            var previous = Current.Value;
            Current.Value = new ImmutableScopeNode(state, previous);
            return new PopOnDispose(previous);
        }

        public static IReadOnlyList<string> RenderAll()
        {
            var scopes = new List<string>();
            for (var node = Current.Value; node is not null; node = node.Parent)
            {
                scopes.Add(Render(node.State));
            }

            return scopes;
        }

        private static string Render(object? state)
        {
            if (state is IEnumerable<KeyValuePair<string, object?>> pairs)
            {
                return string.Join(", ", pairs.Select(pair => $"{pair.Key}={pair.Value}"));
            }

            return state?.ToString() ?? "";
        }

        private sealed record ImmutableScopeNode(object? State, ImmutableScopeNode? Parent);

        private sealed class PopOnDispose(ImmutableScopeNode? previous) : IDisposable
        {
            public void Dispose() => Current.Value = previous;
        }
    }
}
