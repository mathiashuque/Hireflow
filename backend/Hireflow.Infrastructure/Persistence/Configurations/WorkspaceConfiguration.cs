using Hireflow.Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> builder)
    {
        builder.HasKey(workspace => workspace.Id);

        builder.Property(workspace => workspace.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(workspace => workspace.Slug)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(workspace => workspace.CreatedAt)
            .IsRequired();

        // Slugs are always normalized to lowercase before storage, so a plain unique
        // index already enforces case-insensitive uniqueness.
        builder.HasIndex(workspace => workspace.Slug)
            .IsUnique();

        builder.HasMany(workspace => workspace.Members)
            .WithOne(member => member.Workspace)
            .HasForeignKey(member => member.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
