using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hireflow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_JobOpenings_WorkspaceId_Id",
                table: "JobOpenings",
                columns: new[] { "WorkspaceId", "Id" });

            migrationBuilder.CreateTable(
                name: "Candidates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobOpeningId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Stage = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Candidates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Candidates_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Candidates_JobOpenings_WorkspaceId_JobOpeningId",
                        columns: x => new { x.WorkspaceId, x.JobOpeningId },
                        principalTable: "JobOpenings",
                        principalColumns: new[] { "WorkspaceId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Candidates_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_CreatedByUserId",
                table: "Candidates",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_WorkspaceId_JobOpeningId_NormalizedEmail",
                table: "Candidates",
                columns: new[] { "WorkspaceId", "JobOpeningId", "NormalizedEmail" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_WorkspaceId_JobOpeningId_Stage",
                table: "Candidates",
                columns: new[] { "WorkspaceId", "JobOpeningId", "Stage" });

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_WorkspaceId_JobOpeningId_UpdatedAt",
                table: "Candidates",
                columns: new[] { "WorkspaceId", "JobOpeningId", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Candidates");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_JobOpenings_WorkspaceId_Id",
                table: "JobOpenings");
        }
    }
}
