using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hireflow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidateNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateNotes_AspNetUsers_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CandidateNotes_Candidates_WorkspaceId_CandidateId",
                        columns: x => new { x.WorkspaceId, x.CandidateId },
                        principalTable: "Candidates",
                        principalColumns: new[] { "WorkspaceId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CandidateNotes_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateNotes_AuthorUserId",
                table: "CandidateNotes",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateNotes_WorkspaceId_CandidateId_CreatedAt_Id",
                table: "CandidateNotes",
                columns: new[] { "WorkspaceId", "CandidateId", "CreatedAt", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateNotes");
        }
    }
}
