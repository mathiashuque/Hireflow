using Hireflow.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hireflow.Infrastructure.Persistence.Configurations;

public sealed class HireflowUserConfiguration : IEntityTypeConfiguration<HireflowUser>
{
    public void Configure(EntityTypeBuilder<HireflowUser> builder)
    {
        builder.Property(user => user.DisplayName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(user => user.CreatedAt)
            .IsRequired();

        // Identity's base model only creates a unique index on NormalizedUserName.
        // Email uniqueness must also be enforced at the database level rather than
        // relying solely on the application-level pre-check.
        builder.HasIndex(user => user.NormalizedEmail)
            .HasDatabaseName("EmailIndex")
            .IsUnique();
    }
}
