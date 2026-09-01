using Microsoft.EntityFrameworkCore;

namespace Hireflow.Infrastructure.Persistence;

public sealed class HireflowDbContext(DbContextOptions<HireflowDbContext> options)
    : DbContext(options);
