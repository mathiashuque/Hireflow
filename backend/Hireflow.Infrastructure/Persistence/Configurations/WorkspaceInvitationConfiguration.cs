using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class WorkspaceInvitationConfiguration : IEntityTypeConfiguration<WorkspaceInvitation>
{
    public void Configure(EntityTypeBuilder<WorkspaceInvitation> builder)
    {
        builder.HasKey(invitation => invitation.Id);

        builder.Property(invitation => invitation.Email)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(invitation => invitation.NormalizedEmail)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(invitation => invitation.Role)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(32);

        builder.Property(invitation => invitation.TokenHash)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(invitation => invitation.CreatedAt).IsRequired();
        builder.Property(invitation => invitation.ExpiresAt).IsRequired();

        // The hash is looked up directly on acceptance, so it must be unique like any
        // other bearer-token verifier.
        builder.HasIndex(invitation => invitation.TokenHash)
            .IsUnique();

        // At most one unconsumed (not accepted, not revoked) invitation per workspace
        // and normalized email. An expired-but-unconsumed row still occupies this slot
        // until the service explicitly revokes it to make room for a replacement.
        builder.HasIndex(invitation => new { invitation.WorkspaceId, invitation.NormalizedEmail })
            .HasFilter("\"RevokedAt\" IS NULL AND \"AcceptedAt\" IS NULL")
            .IsUnique();

        builder.HasIndex(invitation => invitation.WorkspaceId);

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(invitation => invitation.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict rather than cascade: deleting an Identity account (not yet a feature)
        // should not silently delete or orphan invitation history.
        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(invitation => invitation.InvitedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(invitation => invitation.AcceptedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
