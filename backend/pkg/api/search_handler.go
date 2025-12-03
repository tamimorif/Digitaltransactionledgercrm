package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"gorm.io/gorm"
)

// SearchHandler handles search-related requests
type SearchHandler struct {
	SearchService *services.SearchService
}

// NewSearchHandler creates a new search handler
func NewSearchHandler(db *gorm.DB) *SearchHandler {
	return &SearchHandler{
		SearchService: services.NewSearchService(db),
	}
}

// GlobalSearchHandler performs a global search across all entities
// @Summary Global search
// @Description Search across customers, transactions, remittances, pickups
// @Tags search
// @Produce json
// @Security BearerAuth
// @Param q query string true "Search query"
// @Param limit query int false "Result limit" default(50)
// @Success 200 {array} services.GlobalSearchResult
// @Failure 400 {object} map[string]string
// @Router /search/global [get]
func (sh *SearchHandler) GlobalSearchHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		respondWithError(w, http.StatusBadRequest, "Search query is required")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}

	results, err := sh.SearchService.GlobalSearch(*user.TenantID, query, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Search failed")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"count":   len(results),
		"results": results,
	})
}

// AdvancedSearchHandler performs an advanced filtered search
// @Summary Advanced search
// @Description Search with advanced filters on a specific entity
// @Tags search
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param filter body services.SearchFilter true "Search filter"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Results per page" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /search/advanced [post]
func (sh *SearchHandler) AdvancedSearchHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	var filter services.SearchFilter
	if err := json.NewDecoder(r.Body).Decode(&filter); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if filter.Entity == "" {
		respondWithError(w, http.StatusBadRequest, "Entity type is required")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page == 0 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}

	results, total, err := sh.SearchService.AdvancedSearch(*user.TenantID, filter, page, limit)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"results": results,
		"total":   total,
		"page":    page,
		"limit":   limit,
		"pages":   (total + int64(limit) - 1) / int64(limit),
	})
}

// SaveSearchHandler saves a search filter
// @Summary Save search filter
// @Description Save a search filter for later use
// @Tags search
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body map[string]interface{} true "Search details"
// @Success 201 {object} models.SavedSearch
// @Failure 400 {object} map[string]string
// @Router /search/save [post]
func (sh *SearchHandler) SaveSearchHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	var req struct {
		Name        string                `json:"name"`
		Description string                `json:"description"`
		Filter      services.SearchFilter `json:"filter"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" || req.Filter.Entity == "" {
		respondWithError(w, http.StatusBadRequest, "Name and entity are required")
		return
	}

	savedSearch, err := sh.SearchService.SaveSearch(user.ID, *user.TenantID, req.Name, req.Description, req.Filter)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save search")
		return
	}

	respondWithJSON(w, http.StatusCreated, savedSearch)
}

// GetSavedSearchesHandler retrieves all saved searches for the user
// @Summary Get saved searches
// @Description Get all saved search filters for the user
// @Tags search
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.SavedSearch
// @Failure 400 {object} map[string]string
// @Router /search/saved [get]
func (sh *SearchHandler) GetSavedSearchesHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	searches, err := sh.SearchService.GetSavedSearches(user.ID, *user.TenantID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve saved searches")
		return
	}

	respondWithJSON(w, http.StatusOK, searches)
}

// DeleteSavedSearchHandler deletes a saved search
// @Summary Delete saved search
// @Description Delete a saved search filter
// @Tags search
// @Produce json
// @Security BearerAuth
// @Param id path int true "Saved search ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /search/saved/{id} [delete]
func (sh *SearchHandler) DeleteSavedSearchHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	// Get ID from URL path
	idStr := r.URL.Query().Get("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid search ID")
		return
	}

	if err := sh.SearchService.DeleteSavedSearch(uint(id), user.ID); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Saved search deleted successfully",
	})
}
