using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class WorkspaceMemberConfiguration : IEntityTypeConfiguration<WorkspaceMember>
{
    public void Configure(EntityTypeBuilder<WorkspaceMember> builder)
    {
        // The composite key is also the uniqueness constraint that prevents duplicate
        // membership for the same (WorkspaceId, UserId) pair.
        builder.HasKey(member => new { member.WorkspaceId, member.UserId });

        builder.Property(member => member.Role)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(32);

        builder.Property(member => member.JoinedAt)
            .IsRequired();

        // WorkspaceMember is a Domain type and does not reference HireflowUser, so the
        // Identity side of this relationship is configured here without a navigation
        // property back onto WorkspaceMember.
        builder.HasOne<HireflowUser>()
            .WithMany()
            .HasForeignKey(member => member.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
