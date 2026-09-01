using Hireflow.Domain.Jobs;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class JobOpeningConfiguration : IEntityTypeConfiguration<JobOpening>
{
    public void Configure(EntityTypeBuilder<JobOpening> builder)
    {
        builder.HasKey(job => job.Id);

        // Lets Candidate's FK reference (WorkspaceId, JobOpeningId) as a composite pair,
        // so the database itself rejects a candidate row whose job belongs to a
        // different workspace rather than relying on an application-level check alone.
        builder.HasAlternateKey(job => new { job.WorkspaceId, job.Id });

        builder.Property(job => job.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(job => job.Description)
            .HasMaxLength(4000);

        builder.Property(job => job.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(16);

        builder.Property(job => job.CreatedAt).IsRequired();
        builder.Property(job => job.UpdatedAt).IsRequired();

        // Supports the default (unfiltered) listing order and the status filter,
        // respectively, both scoped to a single workspace.
        builder.HasIndex(job => new { job.WorkspaceId, job.UpdatedAt });
        builder.HasIndex(job => new { job.WorkspaceId, job.Status });

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(job => job.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict rather than cascade: deleting an Identity account (not yet a
        // feature) should not silently delete or orphan hiring records.
        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(job => job.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Postgres's built-in "xmin" system column as the optimistic concurrency
        // token, rather than a hand-maintained version counter. It changes on every
        // row update, so EF can detect a stale write without any application code
        // incrementing it.
        builder.Property<uint>("xmin")
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsRowVersion();
    }
}
