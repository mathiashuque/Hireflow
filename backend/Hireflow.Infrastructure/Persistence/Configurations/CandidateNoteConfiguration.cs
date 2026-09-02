using Hireflow.Domain.Candidates;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class CandidateNoteConfiguration : IEntityTypeConfiguration<CandidateNote>
{
    public void Configure(EntityTypeBuilder<CandidateNote> builder)
    {
        builder.HasKey(note => note.Id);

        builder.Property(note => note.Content)
            .IsRequired()
            .HasMaxLength(4000);

        builder.Property(note => note.CreatedAt).IsRequired();

        // Supports the oldest-first, then-ID timeline read, scoped to one candidate
        // within a workspace.
        builder.HasIndex(note => new { note.WorkspaceId, note.CandidateId, note.CreatedAt, note.Id });

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(note => note.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Composite FK against Candidate's (WorkspaceId, Id) alternate key: the
        // database-enforced guarantee that a note's CandidateId always belongs to the
        // same WorkspaceId as the note itself. Cascade: candidate deletion isn't a
        // current product feature, but if it is added later, its notes should be
        // removed with it rather than orphaned or blocking the delete.
        builder.HasOne<Candidate>()
            .WithMany()
            .HasForeignKey(note => new { note.WorkspaceId, note.CandidateId })
            .HasPrincipalKey(candidate => new { candidate.WorkspaceId, candidate.Id })
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict rather than cascade: deleting the author's Identity account (not yet
        // a feature) must not silently delete or orphan notes other workspace members
        // rely on for recruiting context.
        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(note => note.AuthorUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
