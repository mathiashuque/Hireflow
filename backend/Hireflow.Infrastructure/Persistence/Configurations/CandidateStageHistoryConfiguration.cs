using Hireflow.Domain.Candidates;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class CandidateStageHistoryConfiguration : IEntityTypeConfiguration<CandidateStageHistory>
{
    public void Configure(EntityTypeBuilder<CandidateStageHistory> builder)
    {
        builder.HasKey(history => history.Id);

        builder.Property(history => history.PreviousStage)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(16);

        builder.Property(history => history.NewStage)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(16);

        builder.Property(history => history.ChangedAt).IsRequired();

        // Supports the newest-change-first, then-ID history read, scoped to one
        // candidate within a workspace.
        builder.HasIndex(history => new { history.WorkspaceId, history.CandidateId, history.ChangedAt, history.Id });

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(history => history.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Composite FK against Candidate's (WorkspaceId, Id) alternate key: the
        // database-enforced guarantee that a history row's CandidateId always belongs
        // to the same WorkspaceId as the history row itself. Cascade: candidate
        // deletion isn't a current product feature, but if it is added later, its
        // audit trail should be removed with it rather than orphaned or blocking the
        // delete.
        builder.HasOne<Candidate>()
            .WithMany()
            .HasForeignKey(history => new { history.WorkspaceId, history.CandidateId })
            .HasPrincipalKey(candidate => new { candidate.WorkspaceId, candidate.Id })
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict rather than cascade: deleting the actor's Identity account (not yet
        // a feature) must not silently delete or orphan audit history that other
        // workspace members rely on.
        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(history => history.ChangedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
