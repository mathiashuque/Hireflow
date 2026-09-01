using Hireflow.Domain.Candidates;
using Hireflow.Domain.Jobs;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class CandidateConfiguration : IEntityTypeConfiguration<Candidate>
{
    public void Configure(EntityTypeBuilder<Candidate> builder)
    {
        builder.HasKey(candidate => candidate.Id);

        builder.Property(candidate => candidate.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(candidate => candidate.Email)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(candidate => candidate.NormalizedEmail)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(candidate => candidate.Stage)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(16);

        builder.Property(candidate => candidate.CreatedAt).IsRequired();
        builder.Property(candidate => candidate.UpdatedAt).IsRequired();

        // Supports the default (unfiltered) listing order and the stage filter,
        // respectively, both scoped to a single job within a workspace.
        builder.HasIndex(candidate => new { candidate.WorkspaceId, candidate.JobOpeningId, candidate.UpdatedAt });
        builder.HasIndex(candidate => new { candidate.WorkspaceId, candidate.JobOpeningId, candidate.Stage });

        // Enforces "one active candidate record per normalized email per job" as a
        // database constraint, not just an application-level pre-check. WorkspaceId is
        // included for defense in depth: it makes the index usable directly by the
        // tenant-scoped queries above and keeps the uniqueness scope self-evidently
        // tenant-safe even though JobOpeningId alone already implies a single workspace.
        builder.HasIndex(candidate => new { candidate.WorkspaceId, candidate.JobOpeningId, candidate.NormalizedEmail })
            .IsUnique();

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(candidate => candidate.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Composite FK against JobOpening's (WorkspaceId, Id) alternate key: this is the
        // database-enforced guarantee that a candidate's JobOpeningId always belongs to
        // the same WorkspaceId as the candidate itself. Restrict rather than cascade:
        // deleting a job opening isn't supported yet, and candidate records must not be
        // silently orphaned or removed if that changes without an explicit decision.
        builder.HasOne<JobOpening>()
            .WithMany()
            .HasForeignKey(candidate => new { candidate.WorkspaceId, candidate.JobOpeningId })
            .HasPrincipalKey(job => new { job.WorkspaceId, job.Id })
            .OnDelete(DeleteBehavior.Restrict);

        // Restrict rather than cascade: deleting an Identity account (not yet a
        // feature) should not silently delete or orphan candidate records.
        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(candidate => candidate.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Postgres's built-in "xmin" system column as the optimistic concurrency
        // token, matching JobOpening's concurrency pattern.
        builder.Property<uint>("xmin")
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsRowVersion();
    }
}
