using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hireflow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateStageHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_Candidates_WorkspaceId_Id",
                table: "Candidates",
                columns: new[] { "WorkspaceId", "Id" });

            migrationBuilder.CreateTable(
                name: "CandidateStageHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreviousStage = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    NewStage = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateStageHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateStageHistories_AspNetUsers_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CandidateStageHistories_Candidates_WorkspaceId_CandidateId",
                        columns: x => new { x.WorkspaceId, x.CandidateId },
                        principalTable: "Candidates",
                        principalColumns: new[] { "WorkspaceId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CandidateStageHistories_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateStageHistories_ChangedByUserId",
                table: "CandidateStageHistories",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateStageHistories_WorkspaceId_CandidateId_ChangedAt_Id",
                table: "CandidateStageHistories",
                columns: new[] { "WorkspaceId", "CandidateId", "ChangedAt", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateStageHistories");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Candidates_WorkspaceId_Id",
                table: "Candidates");
        }
    }
}
